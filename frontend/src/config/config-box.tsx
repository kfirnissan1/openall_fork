import { observer } from "mobx-react-lite";
import DraggableWindow from "../draggable-window";
import { counterStore } from "../chat-box";
import { makeAutoObservable } from "mobx";

class ConfigStore {
    constructor() {
        makeAutoObservable(this);
    }

    selectedProvider = 'openrouter';
    modelsLoaded = false;

    selectProvider(provider: string) {
        this.selectedProvider = provider;
        this.modelsLoaded = false;
    }

    loadModels() {
        this.modelsLoaded = true;
    }
}

export const configStore = new ConfigStore();

export const ConfigContent = observer(() => {
    let apiKey = '';
    return <>
        <div className="flex flex-col gap-2 text-sm text-zinc-800">

            <div>
                Connect open/all to a provider of your choice. You can choose between local AI options or various cloud providers. <br/>After selecting a provider, 
                you'll be able to choose from the different models this provider hosts.
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-zinc-600 font-medium">Provider</label>
                <select id="provider" onChange={e => configStore.selectProvider(e.target.value)} defaultValue={configStore.selectedProvider}
                    className="px-2 py-2 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40">
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-zinc-600 font-medium">API Key</label>
                <input type="password" placeholder="sk-..." onChange={(e) => apiKey = e.target.value}
                    className="px-3 py-2 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
            </div>


            <div className="pt-2">
                <button onClick={e => configStore.loadModels()}
                    className="w-full py-2 rounded-xl bg-gray-900/80 hover:bg-gray-900 text-white font-medium shadow-md transition">
                    Load Models
                </button>
            </div>

            <div className="flex flex-col gap-2 relative">
                <label className="text-zinc-600 font-medium">Model</label>

                <select id="provider" disabled={!configStore.modelsLoaded}
                    className="px-2 py-2 disabled:bg-gray-300/60 disabled:text-gray-500 rounded-xl bg-white/60 backdrop-blur border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40">
                    <option value="-">Model list not loaded...</option>
                    <option value="openai/gpt-4o">openai/gpt-4o</option>
                    <option value="openai/gpt-4.1">openai/gpt-4.1</option>
                    <option value="anthropic/claude-3-opus">anthropic/claude-3-opus</option>
                    <option value="anthropic/claude-3-sonnet">anthropic/claude-3-sonnet</option>
                    <option value="google/gemini-pro">google/gemini-pro</option>
                    <option value="meta/llama-3-70b">meta/llama-3-70b</option>
                </select>
            </div>

            <div className="pt-2">
                <button onClick={() => counterStore.saveConfig({ provider: configStore.selectedProvider, apiKey, })}
                    className="w-full py-2 rounded-xl bg-gray-900/80 hover:bg-gray-900 text-white font-medium shadow-md transition">
                    Save Configuration
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