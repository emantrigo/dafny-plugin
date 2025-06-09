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
  ExtensionMode,
} from "vscode";
import { ExtensionConstants, LanguageServerConstants } from "./constants";
import { DafnyCommands } from "./commands";
import { DafnyLanguageClient } from "./language/dafnyLanguageClient";
import checkAndInformAboutInstallation from "./startupCheck";
import { DafnyInstaller } from "./language/dafnyInstallation";
import createAndRegisterDafnyIntegration from "./ui/dafnyIntegration";
import { timeout } from "./tools/timeout";
import { fileIssueURL } from "./ui/statusBarActionView";

const DafnyVersionTimeoutMs = 5_000;
let extensionRuntime: ExtensionRuntime | undefined;

import * as PromiseAny from "promise.any";
import { CommandFactory } from "./ai/commands/commandFactory";
import { AIConfiguration } from "./ai/config/aiConfig";
import { Firebender } from "./ai/service/firebender";
import { ModelSelectorView } from "./ui/modelSelectorView";

export async function activate(
  context: ExtensionContext
): Promise<ExtensionRuntime | undefined> {
  if (!(await checkAndInformAboutInstallation(context))) {
    return undefined;
  }
  
  // Initialize Firebase Remote Config
  try {
    // Set the extension path for Firebase config
    const { FirebaseAdminConfigManager } = await import('./ai/config/firebaseAdminConfig');
    FirebaseAdminConfigManager.setExtensionPath(context.extensionPath);
    
    await AIConfiguration.initializeRemoteConfig();
  } catch (error) {
    console.warn('Failed to initialize Firebase Remote Config:', error);
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

export class ExtensionRuntime {
  private readonly installer: DafnyInstaller;
  private client?: DafnyLanguageClient;
  private languageServerVersion?: string;
  private modelSelector?: ModelSelectorView;

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

    // Register AI commands using the command factory
    commands.registerCommand(DafnyCommands.GenerateLoopInvariants, async () => {
      const command = CommandFactory.createGenerateLoopInvariantsCommand(
        this.client!
      );
      await command.execute();
    });

    commands.registerCommand(
      DafnyCommands.GeneratePrePostConditions,
      async () => {
        const command = CommandFactory.createGeneratePrePostConditionsCommand(
          this.client!
        );
        await command.execute();
      }
    );

    commands.registerCommand(DafnyCommands.GenerateCode, async () => {
      const command = CommandFactory.createGenerateCodeCommand(this.client!);
      await command.execute();
    });

    // Initialize Model Selector View
    this.modelSelector = ModelSelectorView.getInstance();
    this.context.subscriptions.push(this.modelSelector);

    // Register model selector toggle command
    commands.registerCommand(DafnyCommands.ToggleModelSelector, async () => {
      await this.modelSelector!.toggleMode();
    });

    // Register debug command for Remote Config (only in development mode)
    if (this.context.extensionMode === ExtensionMode.Development) {
      commands.registerCommand(DafnyCommands.DebugRemoteConfig, async () => {
        const { FirebaseAdminConfigManager } = await import('./ai/config/firebaseAdminConfig');
        
        const firebaseManager = FirebaseAdminConfigManager.getInstance();
        const firebaseDebugInfo = firebaseManager.getConfigDebugInfo();
        const isAvailable = Firebender.isRemoteConfigAvailable();
        const enabledProviders = Firebender.getEnabledProviders();
        const remoteConfigInfo = AIConfiguration.getRemoteConfigDebugInfo();
        
        const debugInfo = {
          firebaseConfiguration: firebaseDebugInfo,
          isRemoteConfigAvailable: isAvailable,
          enabledProviders,
          remoteConfigData: remoteConfigInfo,
          localVSCodeSettings: {
            maxRetries: Firebender.getMaxRetries(),
            timeout: Firebender.getTimeout(),
            advancedPrompts: Firebender.isAdvancedPromptsEnabled(),
            contextOptimization: Firebender.isContextOptimizationEnabled()
          }
        };
        
        // Show a shorter message in the UI
        window.showInformationMessage(
          `Firebase Status: ${isAvailable ? 'Connected' : 'Not Available'}\nWorking Dir: ${firebaseDebugInfo.workingDirectory}\nProviders: ${enabledProviders.join(', ')}`
        );
        
        // Log detailed info to console
        console.log('Firebase Remote Config Debug Info:', JSON.stringify(debugInfo, null, 2));
        
        // Also show in output channel for easier viewing
        this.statusOutput.appendLine('=== Firebase Remote Config Debug Info ===');
        this.statusOutput.appendLine(JSON.stringify(debugInfo, null, 2));
        this.statusOutput.show();
      });
    }

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
    this.modelSelector?.dispose();
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
