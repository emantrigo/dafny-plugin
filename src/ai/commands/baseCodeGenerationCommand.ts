import * as vscode from 'vscode';
import { AIProviderType } from '../factory/aiProviderFactory';
import { AIConfiguration } from '../config/aiConfig';
import { AiService } from '../service/aiService';
import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { ModelSelectorView } from '../../ui/modelSelectorView';

export abstract class BaseCodeGenerationCommand {
  protected client: DafnyLanguageClient;
  protected configDisposable: vscode.Disposable;

  /**
   * Creates a new code generation command
   *
   * @param client The Dafny language client
   */
  public constructor(client: DafnyLanguageClient) {
    this.client = client;
    this.configDisposable = AIConfiguration.onConfigurationChanged(() => {
      // Configuration change handled, will be fetched fresh on next use
    });
  }

  /**
   * Gets the prompt to send to the AI
   *
   * @param lastErrors Any errors from the previous attempt
   * @returns The prompt to send to the AI
   */
  protected abstract getPrompt(lastErrors: string[]): string;

  /**
   * Gets the status message to show while generating code
   *
   * @param provider The current AI provider
   * @param attempt The current attempt number
   * @param maxTries The maximum number of attempts
   * @returns The status message
   */
  protected abstract getStatusMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string;

  /**
   * Gets the success message to show when code generation succeeds
   *
   * @param provider The AI provider that succeeded
   * @param attempt The attempt number that succeeded
   * @param maxTries The maximum number of attempts
   * @returns The success message
   */
  protected abstract getSuccessMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string;

  /**
   * Executes the code generation command
   */
  public async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if(!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      this.configDisposable.dispose();
      return;
    }

    const selection = editor.selection;
    const originalText = editor.document.getText(selection);

    if(!originalText) {
      vscode.window.showErrorMessage(
        'No text selected. Please select the code you want to process.'
      );
      this.configDisposable.dispose();
      return;
    }

    try {
      const config = await AIConfiguration.getConfiguration();
      const modelSelector = ModelSelectorView.getInstance();

      // Get provider order based on model selector mode
      const providers = modelSelector.getEffectiveProviderOrder();
      const selectedProvider = modelSelector.getEffectiveProvider();

      let currentProviderIndex = providers.indexOf(selectedProvider);
      if(currentProviderIndex === -1) {
        currentProviderIndex = 0;
      }

      const currentText = originalText;
      const lastErrors: string[] = [];

      const success = await this.tryProvidersSequentially(
        providers,
        currentProviderIndex,
        editor,
        selection,
        currentText,
        lastErrors,
        config
      );

      if(!success) {
        await this.revertChanges();
      }
    } finally {
      this.configDisposable.dispose();
    }
  }

  /**
   * Tries each provider sequentially until one succeeds or all fail
   */
  private async tryProvidersSequentially(
    providers: AIProviderType[],
    startIndex: number,
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    initialText: string,
    initialErrors: string[],
    config: Awaited<ReturnType<typeof AIConfiguration.getConfiguration>>
  ): Promise<boolean> {
    let currentProviderIndex = startIndex;
    const currentText = initialText;
    const lastErrors = initialErrors;

    while(currentProviderIndex < providers.length) {
      const currentProvider = providers[currentProviderIndex];
      vscode.window.showInformationMessage(
        `Trying with ${currentProvider} provider...`
      );

      const success = await this.tryWithProvider(
        currentProvider,
        editor,
        selection,
        currentText,
        lastErrors,
        config
      );

      if(success) {
        return true;
      }

      currentProviderIndex++;
      if(currentProviderIndex < providers.length) {
        vscode.window.showInformationMessage(
          `${currentProvider} failed after ${config.maxTries} attempts. Trying next provider...`
        );
      }
    }

    return false;
  }

  /**
   * Tries generating code with a specific provider
   */
  private async tryWithProvider(
    provider: AIProviderType,
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    initialText: string,
    initialErrors: string[],
    config: Awaited<ReturnType<typeof AIConfiguration.getConfiguration>>
  ): Promise<boolean> {
    let tries = 0;
    let currentText = initialText;
    let lastErrors = initialErrors;
    let currentSelection = selection;

    while(tries < config.maxTries) {
      tries++;
      const result = await this.generateAndEvaluateCode(
        provider,
        tries,
        editor,
        currentSelection,
        currentText,
        lastErrors,
        config
      );

      if(result.success) {
        return true;
      }

      currentText = result.updatedText;
      lastErrors = result.errors;
      currentSelection = result.selection;
    }

    return false;
  }

  /**
   * Cleans AI response from explanatory text that isn't valid Dafny code
   *
   * @param aiResponse The raw response from the AI
   * @returns Cleaned Dafny code only
   */
  protected cleanAiResponse(aiResponse: string): string {
    // Remove common explanatory text patterns that appear before code
    const lines = aiResponse.split('\n');
    let codeStartIndex = 0;

    // Skip lines that look like explanations until we find what looks like Dafny code
    for(let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip explanatory text indicators
      if(
        line.startsWith('Here\'s')
        || line.startsWith('Here is')
        || line.startsWith('The corrected')
        || line.startsWith('I\'ve added')
        || line.startsWith('I added')
        || line === ''
        || (line.includes('loop invariant') && !line.includes('invariant '))
        || (line.includes('precondition') && !line.includes('requires '))
        || (line.includes('postcondition') && !line.includes('ensures '))
      ) {
        codeStartIndex = i + 1;
        continue;
      }

      // If we find a line that looks like Dafny code, stop skipping
      if(
        line.includes('method ')
        || line.includes('function ')
        || line.includes('class ')
        || line.includes('predicate ')
        || line.includes('invariant ')
        || line.includes('requires ')
        || line.includes('ensures ')
      ) {
        break;
      }
    }

    // Also remove trailing explanations after the code
    let codeEndIndex = lines.length;
    for(let i = lines.length - 1; i >= codeStartIndex; i--) {
      const line = lines[i].trim();
      if(
        line.startsWith('This ')
        || line.startsWith('Now ')
        || line.startsWith('The ')
        || line.startsWith('I\'ve ')
        || line.startsWith('I ')
        || line === ''
      ) {
        codeEndIndex = i;
        continue;
      } else {
        break;
      }
    }

    const codeLines = lines.slice(codeStartIndex, codeEndIndex);
    return codeLines.join('\n').trim();
  }

  /**
   * Generates code with AI and evaluates the result
   */
  private async generateAndEvaluateCode(
    provider: AIProviderType,
    attempt: number,
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    currentText: string,
    lastErrors: string[],
    config: Awaited<ReturnType<typeof AIConfiguration.getConfiguration>>
  ): Promise<{
    success: boolean,
    selection: vscode.Selection,
    updatedText: string,
    errors: string[]
  }> {
    let waitMessage: vscode.Disposable | undefined;

    try {
      const prompt = this.getPrompt(lastErrors);
      waitMessage = vscode.window.setStatusBarMessage(
        this.getStatusMessage(provider, attempt, config.maxTries)
      );

      const aiResponse = await AiService.callAI(prompt, currentText, provider);

      // Clean the response to remove explanatory text
      const cleanedResponse = this.cleanAiResponse(aiResponse);

      // Format the response
      const formattedResponse = cleanedResponse.trim().replace(/\n{2,}/g, '\n');

      await editor.edit((editBuilder) => {
        editBuilder.replace(selection, formattedResponse);
      });

      const newSelection = editor.selection;

      // Wait for the language server to process the changes
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const errors = diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );

      if(errors.length === 0) {
        vscode.window.showInformationMessage(
          this.getSuccessMessage(provider, attempt, config.maxTries)
        );
        return {
          success: true,
          selection: newSelection,
          updatedText: editor.document.getText(newSelection),
          errors: []
        };
      }

      const newErrors = errors.map((e) => e.message);
      const errorMessages = newErrors.join('\n');
      vscode.window.showWarningMessage(
        `Errors found with ${provider} (Attempt ${attempt}/${config.maxTries}):\n${errorMessages}`
      );

      return {
        success: false,
        selection: newSelection,
        updatedText: editor.document.getText(newSelection),
        errors: newErrors
      };
    } catch(error: unknown) {
      const errorMessage
        = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Error processing Dafny code with ${provider} (Attempt ${attempt}/${config.maxTries}): ${errorMessage}`
      );

      return {
        success: false,
        selection,
        updatedText: currentText,
        errors: lastErrors
      };
    } finally {
      if(waitMessage) {
        waitMessage.dispose();
      }
    }
  }

  /**
   * Reverts changes when all providers fail
   */
  private async revertChanges(): Promise<void> {
    vscode.window.showErrorMessage(
      'All providers failed to generate valid code. Reverting to original code.'
    );

    try {
      await vscode.commands.executeCommand('workbench.action.files.revert');
      vscode.window.showInformationMessage('Unsaved changes removed.');
    } catch(error: unknown) {
      vscode.window.showErrorMessage(
        `Failed to remove unsaved changes: ${error}`
      );
    }
  }
}
