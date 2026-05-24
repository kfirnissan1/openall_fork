import { observer } from "mobx-react-lite";
import DraggableWindow from "../draggable-window";
import { counterStore } from "../chat-box";
import { makeAutoObservable } from "mobx";

const PROVIDERS = [
    { id: 'openrouter', label: 'OpenRouter',    placeholder: 'sk-or-...',  models: ['openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano', 'anthropic/claude-opus-4', 'anthropic/claude-sonnet-4-5', 'anthropic/claude-haiku-4-5', 'google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'meta-llama/llama-4-maverick', 'meta-llama/llama-4-scout'] },
    { id: 'openai',     label: 'OpenAI',        placeholder: 'sk-...',     models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'] },
    { id: 'anthropic',  label: 'Anthropic',     placeholder: 'sk-ant-...', models: ['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'] },
    { id: 'google',     label: 'Google Gemini', placeholder: 'AIza...',    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'] },
];

class ConfigStore {
    constructor() {
        makeAutoObservable(this);
    }

    selectedProvider = 'openrouter';
    selectedModel = PROVIDERS[0].models[0];
    apiKey = '';

    selectProvider(provider: string) {
        this.selectedProvider = provider;
        const providerConfig = PROVIDERS.find(p => p.id === provider);
        this.selectedModel = providerConfig?.models[0] || '';
    }

    selectModel(model: string) {
        this.selectedModel = model;
    }

    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }
}

export const configStore = new ConfigStore();

export const ConfigContent = observer(() => {
    const provider = PROVIDERS.find(p => p.id === configStore.selectedProvider) || PROVIDERS[0];

    return <>
        <div className="flex flex-col gap-2 text-sm text-zinc-800">

            <div>
                Connect openall to a provider of your choice. You can choose between local AI options or various cloud providers. <br />After selecting a provider,
                you'll be able to choose from the different models this provider hosts.
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-zinc-600 font-medium">Provider</label>
                <select id="provider" onChange={e => configStore.selectProvider(e.target.value)} value={configStore.selectedProvider}
                    className="px-2 py-2 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40">
                    {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-zinc-600 font-medium">API Key</label>
                <input type="password" placeholder={provider.placeholder} onChange={(e) => configStore.updateApiKey(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-zinc-600 font-medium">Model</label>
                <select id="model" value={configStore.selectedModel} onChange={e => configStore.selectModel(e.target.value)}
                    className="px-2 py-2 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40">
                    {provider.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            <div className="pt-2 flex gap-2">
                <button onClick={() => counterStore.hideConfig()}
                    className="flex-1 py-2 rounded-xl bg-white/60 border border-white/40 hover:bg-white/80 text-zinc-700 font-medium shadow-sm transition">
                    Cancel
                </button>
                <button disabled={!configStore.apiKey} onClick={() => counterStore.saveConfig({ provider: configStore.selectedProvider, apiKey: configStore.apiKey, model: configStore.selectedModel })}
                    className="flex-1 py-2 rounded-xl bg-gray-900/80 disabled:bg-gray-300 disabled:text-gray-400 hover:bg-gray-900 text-white font-medium shadow-md transition">
                    Save
                </button>
            </div>

        </div>
    </>;
});

export const ConfigBox = observer(() => {
    const m = { minimized: false, title: 'Configuration', id: -1, };

    return (<>
        <div>
            <DraggableWindow loading={false} data={m} modal={true} minimized={m.minimized} windowKey={'win' + m.id} key={'win' + m.id} title={m.title} h={490} w={600}>
                <ConfigContent />
            </DraggableWindow>
        </div>
    </>);
});
