import * as vscode from 'vscode';
import { AIProviderType } from '../factory/aiProviderFactory';

export interface AIProviderConfiguration {
  apiKey: string;
  baseURL?: string;
}

export class AIConfiguration {
  private static readonly CONFIG_SECTION = 'dafny';

  private static readonly DEFAULT_BASE_URLS: Record<AIProviderType, string> = {
    'openai': 'https://api.openai.com/v1',
    'claude': 'https://api.anthropic.com/v1',
    'deepseek': 'https://api.deepseek.com',
    'grok': 'https://api.x.ai/v1'
  };

  private constructor() {}

  public static getProviderOrder(): AIProviderType[] {
    return [ 'deepseek', 'openai', 'claude', 'grok' ];
  }

  public static getDefaultProvider(): AIProviderType {
    return this.getProviderOrder()[0];
  }

  public static getConfiguration(): {
    providers: Record<AIProviderType, AIProviderConfiguration>,
    maxTries: number,
    aiProvider: AIProviderType
    } {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    return {
      providers: {
        openai: {
          apiKey: config.get('openAiApiKey') ?? '',
          baseURL: config.get('openAiBaseUrl') ?? this.DEFAULT_BASE_URLS.openai
        },
        claude: {
          apiKey: config.get('claudeApiKey') ?? '',
          baseURL: config.get('claudeBaseUrl') ?? this.DEFAULT_BASE_URLS.claude
        },
        deepseek: {
          apiKey: config.get('deepseekApiKey') ?? '',
          baseURL: config.get('deepseekBaseUrl') ?? this.DEFAULT_BASE_URLS.deepseek
        },
        grok: {
          apiKey: config.get('grokApiKey') ?? '',
          baseURL: config.get('grokBaseUrl') ?? this.DEFAULT_BASE_URLS.grok
        }
      },
      maxTries: config.get('numberOfRetries') ?? 3,
      aiProvider: (config.get('aiProvider') as AIProviderType) ?? this.getDefaultProvider()
    };
  }

  public static onConfigurationChanged(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if(event.affectsConfiguration(this.CONFIG_SECTION)) {
        callback();
      }
    });
  }
}