import { initializeApp, FirebaseApp } from 'firebase/app';
import * as fs from 'fs';
import * as path from 'path';

export interface FirebaseConfiguration {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export class FirebaseConfigManager {
  private static instance: FirebaseConfigManager;
  private app: FirebaseApp | null = null;
  private isInitialized = false;
  private static extensionPath: string | undefined;

  private constructor() {}

  public static setExtensionPath(extensionPath: string): void {
    this.extensionPath = extensionPath;
  }

  public static getInstance(): FirebaseConfigManager {
    if(FirebaseConfigManager.instance === undefined) {
      FirebaseConfigManager.instance = new FirebaseConfigManager();
    }
    return FirebaseConfigManager.instance;
  }

  public initialize(): void {
    if(this.isInitialized) {
      return;
    }

    try {
      const firebaseConfig = this.getFirebaseConfig();
      this.app = initializeApp(firebaseConfig);
      this.isInitialized = true;
    } catch(error: unknown) {
      console.error('Failed to initialize Firebase:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  private getFirebaseConfig(): FirebaseConfiguration {
    // Try to load from .env file first
    const envConfig = this.loadEnvConfig();

    return {
      apiKey: envConfig['FIREBASE_API_KEY'] || process.env['FIREBASE_API_KEY'] || '',
      authDomain: envConfig['FIREBASE_AUTH_DOMAIN'] || process.env['FIREBASE_AUTH_DOMAIN'] || '',
      projectId: envConfig['FIREBASE_PROJECT_ID'] || process.env['FIREBASE_PROJECT_ID'] || '',
      storageBucket: envConfig['FIREBASE_STORAGE_BUCKET'] || process.env['FIREBASE_STORAGE_BUCKET'],
      messagingSenderId: envConfig['FIREBASE_MESSAGING_SENDER_ID'] || process.env['FIREBASE_MESSAGING_SENDER_ID'],
      appId: envConfig['FIREBASE_APP_ID'] || process.env['FIREBASE_APP_ID'] || '',
      measurementId: envConfig['FIREBASE_MEASUREMENT_ID'] || process.env['FIREBASE_MEASUREMENT_ID']
    };
  }

  private loadEnvConfig(): Record<string, string> {
    const possiblePaths = [
      // Extension directory (where package.json is)
      FirebaseConfigManager.extensionPath ? path.join(FirebaseConfigManager.extensionPath, '.env') : undefined,
      // Current working directory
      path.join(process.cwd(), '.env'),
      // Parent directory of current working directory
      path.join(process.cwd(), '..', '.env'),
      // Home directory
      path.join(require('os').homedir(), '.env')
    ].filter(Boolean) as string[];

    for(const envPath of possiblePaths) {
      try {
        if(fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const envConfig: Record<string, string> = {};

          envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if(trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
              const [ key, ...valueParts ] = trimmedLine.split('=');
              const value = valueParts.join('=').trim();
              envConfig[key.trim()] = value;
            }
          });

          console.log(`✅ Loaded Firebase config from .env file: ${envPath}`);
          return envConfig;
        } else {
          console.log(`❌ .env file not found at: ${envPath}`);
        }
      } catch(error) {
        console.warn(`Error loading .env from ${envPath}:`, error);
      }
    }

    console.warn('🚨 No .env file found in any of the expected locations');
    return {};
  }

  public isConfigured(): boolean {
    const config = this.getFirebaseConfig();
    const isConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

    if(!isConfigured) {
      console.log('Firebase configuration check failed:', {
        hasApiKey: Boolean(config.apiKey),
        hasAuthDomain: Boolean(config.authDomain),
        hasProjectId: Boolean(config.projectId),
        hasAppId: Boolean(config.appId),
        // Don't log actual values for security
        configKeys: Object.keys(config).filter(key => config[key as keyof FirebaseConfiguration])
      });
    }

    return isConfigured;
  }

  public getConfigDebugInfo(): any {
    const config = this.getFirebaseConfig();
    const possiblePaths = [
      FirebaseConfigManager.extensionPath ? path.join(FirebaseConfigManager.extensionPath, '.env') : 'Extension path not set',
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '..', '.env'),
      path.join(require('os').homedir(), '.env')
    ];

    return {
      hasApiKey: Boolean(config.apiKey),
      hasAuthDomain: Boolean(config.authDomain),
      hasProjectId: Boolean(config.projectId),
      hasAppId: Boolean(config.appId),
      projectId: config.projectId, // Safe to show project ID
      authDomain: config.authDomain, // Safe to show auth domain
      workingDirectory: process.cwd(),
      extensionPath: FirebaseConfigManager.extensionPath,
      envPathsChecked: possiblePaths,
      envFilesExist: possiblePaths.map(p => p === 'Extension path not set' ? false : fs.existsSync(p))
    };
  }
}