/* eslint-disable */

import {
  Disposable,
  ExtensionContext,
  OutputChannel,
  window,
  workspace,
  commands,
  Uri,
  CancellationToken,
  Position,
} from "vscode";
import { ExtensionConstants, LanguageServerConstants } from "./constants";
import { DafnyCommands } from "./commands";
import { DafnyLanguageClient } from "./language/dafnyLanguageClient";
import checkAndInformAboutInstallation from "./startupCheck";
import { DafnyInstaller } from "./language/dafnyInstallation";
import createAndRegisterDafnyIntegration from "./ui/dafnyIntegration";
import { timeout } from "./tools/timeout";
import { fileIssueURL } from "./ui/statusBarActionView";

import * as vscode from "vscode";

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

import * as PromiseAny from "promise.any";
import { AIProviderFactory, AIProviderType } from './ai/factory/aiProviderFactory';
import { AIProviderConfig } from './ai/factory/aiProviderFactory';
import { AIConfiguration } from './ai/config/aiConfig';

export async function activate(
  context: ExtensionContext
): Promise<ExtensionRuntime | undefined> {
  if (!(await checkAndInformAboutInstallation(context))) {
    return undefined;
  }
  const statusOutput = window.createOutputChannel(
    ExtensionConstants.ChannelName
  );
  context.subscriptions.push(statusOutput);
  extensionRuntime = new ExtensionRuntime(context, statusOutput);
  await extensionRuntime.initialize();
  return extensionRuntime;
}

export async function deactivate(): Promise<void> {
  await extensionRuntime?.dispose();
}

export async function restartServer(): Promise<void> {
  await extensionRuntime?.restart();
}

async function callAI(
  config: ReturnType<typeof AIConfiguration.getConfiguration>,
  prompt: string,
  code: string,
  provider: AIProviderType
): Promise<string> {
  try {
    const providerConfig = config.providers[provider];
    const aiProvider = AIProviderFactory.createProvider({
      type: provider,
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL
    });
    return await aiProvider.generateCompletion(prompt, code);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`${provider} API error: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while calling ${provider} API`);
  }
}

async function GenerateLoopInvariantsFunction(
  client: DafnyLanguageClient
): Promise<void> {
  let config = AIConfiguration.getConfiguration();
  const configDisposable = AIConfiguration.onConfigurationChanged(() => {
    config = AIConfiguration.getConfiguration();
  });

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    configDisposable.dispose();
    return;
  }

  let selection = editor.selection;
  const originalText = editor.document.getText(selection);

  if (!originalText) {
    vscode.window.showErrorMessage(
      "No text selected. Please select the code you want to process."
    );
    configDisposable.dispose();
    return;
  }

  const providers = AIConfiguration.getProviderOrder();
  let currentProviderIndex = providers.indexOf(config.aiProvider);
  if (currentProviderIndex === -1) currentProviderIndex = 0;

  let currentText = originalText;
  let success = false;
  let lastErrors: string[] = [];

  while (currentProviderIndex < providers.length && !success) {
    const currentProvider = providers[currentProviderIndex];
    let tries = 0;

    vscode.window.showInformationMessage(`Trying with ${currentProvider} provider...`);

    while (tries < config.maxTries && !success) {
      tries++;
      let waitMessage: vscode.Disposable | undefined;
      try {
        let prompt =
          "Analyze the following Dafny code. Add appropriate loop invariants and fix any errors you find. Do not change the original code structure or functionality. Only add loop invariants and fix errors. Provide the resulting code without any explanations or additional text:";

        if (lastErrors.length > 0) {
          prompt +=
            "\n\nThe previous attempt resulted in the following errors. Please address these specifically:\n" +
            lastErrors.join("\n");
        }

        waitMessage = vscode.window.setStatusBarMessage(
          `Generating loop invariants with ${currentProvider}... (Attempt ${tries}/${config.maxTries})`
        );

        const aiResponse = await callAI(
          config,
          prompt,
          currentText,
          currentProvider
        );

        const formattedResponse = aiResponse.trim().replace(/\n{2,}/g, "\n");

        await editor.edit((editBuilder) => {
          editBuilder.replace(selection, formattedResponse);
        });

        selection = editor.selection;

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const errors = diagnostics.filter(
          (d) => d.severity === vscode.DiagnosticSeverity.Error
        );

        if (errors.length === 0) {
          success = true;
          vscode.window.showInformationMessage(
            `Success! Loop invariants added and errors fixed using ${currentProvider} (Attempt ${tries}/${config.maxTries})`
          );
        } else {
          lastErrors = errors.map((e) => e.message);
          const errorMessages = lastErrors.join("\n");
          vscode.window.showWarningMessage(
            `Errors found with ${currentProvider} (Attempt ${tries}/${config.maxTries}):\n${errorMessages}`
          );

          currentText = editor.document.getText(selection);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error processing Dafny code with ${currentProvider} (Attempt ${tries}/${config.maxTries}): ${error}`
        );
      } finally {
        // Ensure the status message is always disposed
        if (waitMessage) {
          waitMessage.dispose();
        }
      }
    }

    if (!success) {
      currentProviderIndex++;
      if (currentProviderIndex < providers.length) {
        vscode.window.showInformationMessage(
          `${currentProvider} failed after ${config.maxTries} attempts. Trying next provider...`
        );
      }
    }
  }

  if (!success) {
    vscode.window.showErrorMessage(
      "All providers failed to generate valid loop invariants. Reverting to original code."
    );
    try {
      await vscode.commands.executeCommand("workbench.action.files.revert");
      vscode.window.showInformationMessage("Unsaved changes removed.");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to remove unsaved changes: ${error}`
      );
    }
  }

  configDisposable.dispose();
}

export class ExtensionRuntime {
  private readonly installer: DafnyInstaller;
  private client?: DafnyLanguageClient;
  private languageServerVersion?: string;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {
    this.installer = new DafnyInstaller(context, statusOutput);
  }

  public async initialize(): Promise<void> {
    workspace.registerTextDocumentContentProvider("dafny", {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      provideTextDocumentContent: function (
        uri: Uri,
        token: CancellationToken
      ) {
        return "// Viewing Dafny libraries in the Dafny IDE is not yet supported.";
      },
    });

    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(
      this.installer,
      this.client!,
      this.languageServerVersion!
    );
    commands.registerCommand(DafnyCommands.RestartServer, restartServer);
    commands.registerCommand(DafnyCommands.GenerateLoopInvariants, () =>
      GenerateLoopInvariantsFunction(
        this.client!
      )
    );
    this.statusOutput.appendLine("Dafny is ready");
  }

  private async getLanguageServerVersionAfterStartup(): Promise<string> {
    let versionRegistration: Disposable | undefined;
    const version = await PromiseAny([
      new Promise<string>((resolve) => {
        versionRegistration = this.client!.onServerVersion((version) =>
          resolve(version)
        );
      }),
      // Fallback to unknown in case the server does not report the version.
      timeout(DafnyVersionTimeoutMs, LanguageServerConstants.UnknownVersion),
    ]);
    versionRegistration!.dispose();
    return version;
  }

  public async dispose(): Promise<void> {
    await this.client?.stop();
  }

  public async startClientAndWaitForVersion() {
    this.client =
      this.client ?? (await DafnyLanguageClient.create(this.installer));
    await this.client.start();
    this.languageServerVersion =
      await this.getLanguageServerVersionAfterStartup();
  }

  public async restart(): Promise<void> {
    this.statusOutput.appendLine("Terminating Dafny...");
    try {
      await this.dispose();
    } catch (e: unknown) {
      this.statusOutput.appendLine("Server did not respond...");
    }
    // The first subscription is the statusOutput and should not be disposed.
    for (let i = 1; i < this.context.subscriptions.length; i++) {
      this.context.subscriptions[i].dispose();
    }
    this.context.subscriptions.splice(1);
    await this.startClientAndWaitForVersion();
    createAndRegisterDafnyIntegration(
      this.installer,
      this.client!,
      this.languageServerVersion!
    );
    const issueURL = await fileIssueURL(
      this.languageServerVersion ?? "???",
      this.context
    );
    this.statusOutput.appendLine(
      "Dafny is ready again.\nIf you have time, please let us know why you needed to restart by filing an issue:\n" +
        issueURL
    );
  }
}
