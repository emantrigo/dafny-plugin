import * as vscode from 'vscode';
import { AIConfiguration } from '../ai/config/aiConfig';
import { AIProviderType } from '../ai/factory/aiProviderFactory';

export interface ModelSelection {
  isAutoMode: boolean;
  selectedProvider?: AIProviderType;
  selectedModel?: string;
}

export class ModelSelectorView {
  private static instance: ModelSelectorView;
  private statusBarItem: vscode.StatusBarItem;
  private currentSelection: ModelSelection;
  private readonly configDisposable: vscode.Disposable;

  private constructor() {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100 // Priority - appears before other items
    );

    this.currentSelection = {
      isAutoMode: true
    };

    // Initialize display
    this.updateStatusBarDisplay();
    this.statusBarItem.show();

    // Listen for configuration changes
    this.configDisposable = AIConfiguration.onConfigurationChanged(() => {
      this.updateStatusBarDisplay();
    });
  }

  public static getInstance(): ModelSelectorView {
    if(ModelSelectorView.instance === undefined) {
      ModelSelectorView.instance = new ModelSelectorView();
    }
    return ModelSelectorView.instance;
  }

  private updateStatusBarDisplay(): void {
    if(this.currentSelection.isAutoMode) {
      this.statusBarItem.text = '$(robot) Auto';
      this.statusBarItem.tooltip = 'AI Model: Auto';
    } else {
      const provider = this.currentSelection.selectedProvider ?? 'none';
      const model = this.currentSelection.selectedModel ?? 'default';
      this.statusBarItem.text = `$(gear) ${provider}`;
      this.statusBarItem.tooltip = `AI Model: ${provider} (${model})`;
    }

    this.statusBarItem.command = 'dafny.toggleModelSelector';
  }

  public async toggleMode(): Promise<void> {
    if(this.currentSelection.isAutoMode) {
      // Switch to manual mode - show provider selection
      await this.showProviderSelection();
    } else {
      // Switch to auto mode
      this.currentSelection = {
        isAutoMode: true
      };
      this.updateStatusBarDisplay();

      vscode.window.showInformationMessage('AI Model set to Auto mode');
    }
  }

  private async showProviderSelection(): Promise<void> {
    try {
      // Get available providers from Remote Config
      const providers = AIConfiguration.getProviderOrder();

      const providerItems = providers
        .map((provider) => {
          const isEnabled = AIConfiguration.isProviderEnabled(provider);
          const model
            = AIConfiguration.getModelForProvider(provider) ?? 'default';

          return {
            label: `$(${this.getProviderIcon(provider)}) ${provider}`,
            description: `Model: ${model}`,
            detail: isEnabled ? 'Available' : 'Disabled',
            provider,
            model,
            enabled: isEnabled
          };
        })
        .filter((item) => item.enabled); // Only show enabled providers

      if(providerItems.length === 0) {
        vscode.window.showWarningMessage(
          'No AI providers are currently available.'
        );
        return;
      }

      const selected = await vscode.window.showQuickPick(providerItems, {
        placeHolder: 'Select AI Provider',
        title: 'Choose AI Model'
      });

      if(selected) {
        this.currentSelection = {
          isAutoMode: false,
          selectedProvider: selected.provider,
          selectedModel: selected.model
        };

        this.updateStatusBarDisplay();

        vscode.window.showInformationMessage(
          `AI Model set to ${selected.provider} (${selected.model})`
        );
      }
    } catch(error: unknown) {
      console.error('Error showing provider selection:', error);
      vscode.window.showErrorMessage('Failed to load AI providers');
    }
  }

  private getProviderIcon(provider: AIProviderType): string {
    const icons: Record<AIProviderType, string> = {
      openai: 'symbol-method',
      claude: 'symbol-class',
      deepseek: 'symbol-interface',
      grok: 'symbol-function'
    };
    return icons[provider] || 'symbol-misc';
  }

  public getCurrentSelection(): ModelSelection {
    return { ...this.currentSelection };
  }

  public getEffectiveProvider(): AIProviderType {
    if(this.currentSelection.isAutoMode) {
      // Use default provider from configuration
      return AIConfiguration.getDefaultProvider();
    } else {
      // Use manually selected provider
      return (
        this.currentSelection.selectedProvider
        ?? AIConfiguration.getDefaultProvider()
      );
    }
  }

  public getEffectiveProviderOrder(): AIProviderType[] {
    if(this.currentSelection.isAutoMode) {
      // Use Remote Config order
      return AIConfiguration.getProviderOrder();
    } else {
      // Put selected provider first, then others
      const selectedProvider = this.currentSelection.selectedProvider;
      if(selectedProvider) {
        const allProviders = AIConfiguration.getProviderOrder();
        const otherProviders = allProviders.filter(
          (p) => p !== selectedProvider
        );
        return [ selectedProvider, ...otherProviders ];
      }
      return AIConfiguration.getProviderOrder();
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    this.configDisposable.dispose();
  }
}
