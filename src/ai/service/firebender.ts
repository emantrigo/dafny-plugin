import { FirebaseRemoteConfigService } from './firebaseRemoteConfigService';
import { AIConfiguration } from '../config/aiConfig';
import { AIProviderType } from '../factory/aiProviderFactory';

/**
 * Firebender - Firebase utilities for the Dafny AI extension
 * Provides convenient methods for managing AI configurations via Firebase Remote Config
 */
export class Firebender {
  private static remoteConfigService: FirebaseRemoteConfigService;

  public static async initialize(): Promise<void> {
    this.remoteConfigService = FirebaseRemoteConfigService.getInstance();
    await this.remoteConfigService.initialize();
  }

  /**
   * Check if a specific AI feature is enabled via Remote Config
   */
  public static isFeatureEnabled(
    feature: 'loopInvariants' | 'prePostConditions' | 'codeGeneration'
  ): boolean {
    return AIConfiguration.isFeatureEnabled(feature);
  }

  /**
   * Check if a specific AI provider is enabled via Remote Config
   */
  public static isProviderEnabled(provider: AIProviderType): boolean {
    return AIConfiguration.isProviderEnabled(provider);
  }

  /**
   * Get the preferred model for a specific provider from Remote Config
   */
  public static getModelForProvider(
    provider: AIProviderType
  ): string | undefined {
    return AIConfiguration.getModelForProvider(provider);
  }

  /**
   * Get the list of enabled AI providers in priority order
   */
  public static getEnabledProviders(): AIProviderType[] {
    const allProviders = AIConfiguration.getProviderOrder();
    return allProviders.filter((provider) => this.isProviderEnabled(provider));
  }

  /**
   * Get the first available enabled provider
   */
  public static getFirstEnabledProvider(): AIProviderType | null {
    const enabledProviders = this.getEnabledProviders();
    return enabledProviders.length > 0 ? enabledProviders[0] : null;
  }

  /**
   * Refresh Remote Config and get the latest values
   */
  public static async refreshConfig(): Promise<boolean> {
    if(this.remoteConfigService !== undefined) {
      return await this.remoteConfigService.refresh();
    }
    return false;
  }

  /**
   * Get all Remote Config values for debugging
   */
  public static getAllRemoteConfig(): Record<string, any> {
    if(this.remoteConfigService !== undefined) {
      return this.remoteConfigService.getAllConfig();
    }
    return {};
  }

  /**
   * Check if Firebase Remote Config is available and configured
   */
  public static isRemoteConfigAvailable(): boolean {
    return (
      this.remoteConfigService !== null
      && this.remoteConfigService !== undefined
    );
  }

  /**
   * Get timeout value from Remote Config or default
   */
  public static getTimeout(): number {
    if(this.remoteConfigService !== undefined) {
      return this.remoteConfigService.getTimeout();
    }
    return 30000; // 30 seconds default
  }

  /**
   * Get max retries from Remote Config or default
   */
  public static getMaxRetries(): number {
    if(this.remoteConfigService !== undefined) {
      return this.remoteConfigService.getMaxRetries();
    }
    return 3; // Default
  }

  /**
   * Check if advanced prompts are enabled
   */
  public static isAdvancedPromptsEnabled(): boolean {
    if(this.remoteConfigService !== undefined) {
      return this.remoteConfigService.isAdvancedPromptsEnabled();
    }
    return false; // Default to false
  }

  /**
   * Check if context optimization is enabled
   */
  public static isContextOptimizationEnabled(): boolean {
    if(this.remoteConfigService !== undefined) {
      return this.remoteConfigService.isContextOptimizationEnabled();
    }
    return true; // Default to true
  }
}
