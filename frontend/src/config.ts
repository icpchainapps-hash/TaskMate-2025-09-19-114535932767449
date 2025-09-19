import { CreateActorOptions } from 'declarations/backend';
import { createActor, canisterId, type backendInterface } from './backend';

const DEFAULT_STORAGE_GATEWAY_URL = 'https://dev-blob.caffeine.ai';
const DEFAULT_BUCKET_NAME = 'default-bucket';
const DEFAULT_PROJECT_ID = '0000000-0000-0000-0000-00000000000';

interface JsonConfig {
    backend_host: string;
    backend_canister_id: string;
    project_id: string;
}

interface Config {
    backend_host?: string;
    backend_canister_id: string;
    storage_gateway_url: string;
    bucket_name: string;
    project_id: string;
}

let configCache: Config | null = null;

export async function loadConfig(): Promise<Config> {
    if (configCache) {
        return configCache;
    }
    try {
        const response = await fetch('./env.json');
        const config = (await response.json()) as JsonConfig;
        const fullConfig = {
            backend_host: config.backend_host == 'undefined' ? undefined : config.backend_host,
            backend_canister_id: config.backend_canister_id == 'undefined' ? canisterId : config.backend_canister_id,
            storage_gateway_url: process.env.STORAGE_GATEWAY_URL ?? 'nogateway',
            bucket_name: DEFAULT_BUCKET_NAME,
            project_id: config.project_id && config.project_id !== 'undefined' ? config.project_id : DEFAULT_PROJECT_ID
        };
        configCache = fullConfig;
        return fullConfig;
    } catch {
        const fallbackConfig = {
            backend_host: undefined,
            backend_canister_id: canisterId,
            storage_gateway_url: DEFAULT_STORAGE_GATEWAY_URL,
            bucket_name: DEFAULT_BUCKET_NAME,
            project_id: DEFAULT_PROJECT_ID
        };
        return fallbackConfig;
    }
}

function extractAgentErrorMessage(error: string): string {
    const errorString = String(error);
    const match = errorString.match(/with message:\s*'([^']+)'/s);
    return match ? match[1] : errorString;
}

function processError(e: unknown): never {
    if (e && typeof e === 'object' && 'message' in e) {
        throw new Error(extractAgentErrorMessage(e['message'] as string));
    } else throw e;
}

export async function createActorWithConfig(options?: CreateActorOptions): Promise<backendInterface> {
    const config = await loadConfig();
    if (!options) {
        options = {};
    }
    if (config.backend_host) {
        options = {
            ...options,
            agentOptions: {
                ...options.agentOptions,
                host: config.backend_host
            }
        };
    }
    return createActor(config.backend_canister_id, options, processError);
}
