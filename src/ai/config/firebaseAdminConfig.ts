import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

export interface FirebaseAdminConfiguration {
  projectId: string;
  serviceAccount: admin.ServiceAccount;
}

export interface RemoteConfigValue {
  value: string;
  source: 'remote' | 'default' | 'static';
}

export class FirebaseAdminConfigManager {
  private static instance: FirebaseAdminConfigManager;
  private static extensionPath: string | undefined;
  private remoteConfigCache: Record<string, any> = {};
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static setExtensionPath(extensionPath: string): void {
    this.extensionPath = extensionPath;
  }

  public static getInstance(): FirebaseAdminConfigManager {
    if(FirebaseAdminConfigManager.instance === undefined) {
      FirebaseAdminConfigManager.instance = new FirebaseAdminConfigManager();
    }
    return FirebaseAdminConfigManager.instance;
  }

  private getFirebaseConfig(): FirebaseAdminConfiguration | null {
    const envConfig = this.loadEnvConfig();
    const projectId = envConfig['FIREBASE_PROJECT_ID'] || process.env['FIREBASE_PROJECT_ID'] || '';

    // Try to load service account from different locations
    const serviceAccount = this.loadServiceAccount();

    if(!projectId || !serviceAccount) {
      return null;
    }

    return {
      projectId,
      serviceAccount
    };
  }

  private loadServiceAccount(): admin.ServiceAccount | null {
    const possiblePaths = [
      FirebaseAdminConfigManager.extensionPath ? path.join(FirebaseAdminConfigManager.extensionPath, 'firebase-service-account.json') : undefined,
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(process.cwd(), 'serviceAccount.json')
    ].filter(Boolean) as string[];

    // Try environment variable first
    const envServiceAccount = process.env['FIREBASE_SERVICE_ACCOUNT'];
    if(envServiceAccount) {
      try {
        const parsed = JSON.parse(envServiceAccount);
        console.log('✅ Loaded service account from environment variable');
        return parsed;
      } catch(error) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT from environment:', error);
      }
    }

    // Try loading from .env file
    const envConfig = this.loadEnvConfig();
    if(envConfig['FIREBASE_SERVICE_ACCOUNT']) {
      try {
        const parsed = JSON.parse(envConfig['FIREBASE_SERVICE_ACCOUNT']);
        console.log('✅ Loaded service account from .env file');
        return parsed;
      } catch(error) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT from .env:', error);
      }
    }

    // Try loading from JSON files
    for(const filePath of possiblePaths) {
      try {
        if(fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          console.log(`✅ Loaded service account from file: ${filePath}`);
          return parsed;
        }
      } catch(error) {
        console.warn(`Failed to load service account from ${filePath}:`, error);
      }
    }

    console.warn('🚨 No Firebase service account found');
    return null;
  }

  public async fetchRemoteConfig(): Promise<Record<string, any>> {
    const config = this.getFirebaseConfig();

    if(!config) {
      console.warn('Firebase configuration incomplete, using cached values');
      return this.remoteConfigCache;
    }

    // Check cache first
    const now = Date.now();
    if(now - this.lastFetchTime < this.CACHE_DURATION && Object.keys(this.remoteConfigCache).length > 0) {
      console.log('Using cached Firebase Remote Config');
      return this.remoteConfigCache;
    }

    try {
      // Initialize Firebase Admin if not already done
      if(!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(config.serviceAccount),
          projectId: config.projectId
        });
        console.log('✅ Firebase Admin initialized');
      }

      // Get Remote Config template
      const remoteConfig = admin.remoteConfig();
      const template = await remoteConfig.getTemplate();

      // Parse the remote config parameters
      const parsedConfig: Record<string, any> = {};

      for(const [ key, parameter ] of Object.entries(template.parameters)) {
        if(parameter.defaultValue) {
          try {
            // Access the value correctly based on Firebase Admin SDK types
            const defaultValue = parameter.defaultValue as any;
            const value = defaultValue.value || defaultValue;

            if(typeof value === 'string') {
              try {
                parsedConfig[key] = JSON.parse(value);
              } catch{
                parsedConfig[key] = value;
              }
            } else {
              parsedConfig[key] = value;
            }
          } catch{
            const defaultValue = parameter.defaultValue as any;
            parsedConfig[key] = defaultValue.value || defaultValue;
          }
        }
      }

      this.remoteConfigCache = parsedConfig;
      this.lastFetchTime = now;
      console.log('✅ Successfully fetched Firebase Remote Config via Admin SDK');
      console.log('📋 Remote Config keys:', Object.keys(parsedConfig));

      return parsedConfig;

    } catch(error) {
      console.error('Error fetching Firebase Remote Config:', error);
    }

    return this.remoteConfigCache;
  }

  private loadEnvConfig(): Record<string, string> {
    const possiblePaths = [
      FirebaseAdminConfigManager.extensionPath ? path.join(FirebaseAdminConfigManager.extensionPath, '.env') : undefined,
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '..', '.env'),
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
        }
      } catch(error) {
        console.warn(`Error loading .env from ${envPath}:`, error);
      }
    }

    return {};
  }

  public isConfigured(): boolean {
    const config = this.getFirebaseConfig();
    return config !== null;
  }

  public getServiceAccountCredentials(): admin.ServiceAccount | null {
    const config = this.getFirebaseConfig();
    return config?.serviceAccount || null;
  }

  public getConfigDebugInfo(): any {
    const config = this.getFirebaseConfig();

    return {
      isConfigured: config !== null,
      hasProjectId: config ? Boolean(config.projectId) : false,
      hasServiceAccount: config ? Boolean(config.serviceAccount) : false,
      projectId: config?.projectId || 'Not configured', // Safe to show project ID
      serviceAccountType: config?.serviceAccount ? (config.serviceAccount as any).type : 'Not loaded',
      cacheSize: Object.keys(this.remoteConfigCache).length,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : 0,
      workingDirectory: process.cwd(),
      extensionPath: FirebaseAdminConfigManager.extensionPath,
      adminAppsInitialized: admin.apps.length
    };
  }
}