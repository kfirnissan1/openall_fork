import { makeAutoObservable } from "mobx";
import { Connection, connectionStatus } from "./connectivity/connection";
import { observer } from "mobx-react-lite";
import { marked } from "marked";
import { useState } from "react";
import DraggableWindow, { activeWindowStore } from "./draggable-window";
import React from "react";
import { ShareModal } from "./share/share-modal";

class CounterStore {
    count = 0;
    private connection: Promise<Connection>;
    messages: any[] = [];
    windows: any[] = [];
    showConfig = false;
    showSettings = false;
    showConnectors = false;
    initialized = false;
    shareState: { active: boolean; imageDataUrl: string; windowTitle: string } | null = null;

    prompts!: { chatPrompt: string, uiActionPrompt: string, };

    constructor() {
        makeAutoObservable(this);
        this.connection = Connection.connect(this);
    }

    onWebsocketMessage(event: MessageEvent<any>) {
        console.log('msg', event);
        const eventData = JSON.parse(event.data);
        console.log(eventData);
        if (eventData.event === 'ui') {
            eventData.data.minimized = false;
            const existingWindow = this.windows.find(w => w.id === eventData.data.id);
            if (existingWindow) {
                existingWindow.content = eventData.data.content;
                existingWindow.title = eventData.data.title;
                existingWindow.loading = false;
                existingWindow.inputs = {};
            } else {
                this.windows.push(eventData.data);
            }
            return;
        }
        if (eventData.event === 'refresh') {
            window.location.reload();
            return;
        }
        if (eventData.event === 'settings') {
            this.prompts = eventData.data.prompts;
            this.initialized = true;
        }
        if (eventData.event === 'showConfig') {
            console.log('showconfig');
            this.showConfig = true;
            return;
        }
        if (eventData.event === 'closeWindow') {
            this.windows = this.windows.filter(w => w.id !== eventData.data.id);
            return;
        }
        if (eventData.event === 'log') {
            this.messages.push({ log: eventData.data.content, });
            return;
        }
        if (eventData.event !== 'message') {
            return;
        }
        // console.log(eventData.data);
        this.messages.push(eventData.data);
    }

    minimize(data: any) {
        data.minimized = true;
    }

    increment() {
        this.count++;
    }

    showConfigWindow() {
        this.showConfig = true;
    }

    hideConfig() {
        this.showConfig = false;
    }

    sendChat(text: string) {
        this.connection.then(c => c.sendChat(text));
    }

    closeWindow(id: number) {
        this.connection.then(c => c.closeWindow(id));
    }

    restoreWindow(id: number) {
        this.windows.find(w => w.id === id).minimized = false;
    }

    saveConfig(config: { provider: string; apiKey: string; model: string }) {
        this.connection.then(c => c.saveConfig(config));
        this.showConfig = false;
    }

    setShowSettings(show: boolean) {
        this.showSettings = show;
    }

    setShowConnectors(show: boolean) {
        this.showConnectors = show;
    }

    doAction(activeWindowId: number, inputs: { [key: string]: string }, ...args: any[]) {
        this.connection.then(c => c.doAction(activeWindowId, inputs, ...args));
    }

    sendMessage(messageType: string, data: any) {
        this.connection.then(c => c.sendMessage(messageType, data));
    }

    setShareState(s: typeof this.shareState) {
        this.shareState = s;
    }
}

export const counterStore = new CounterStore();

const MessageList = observer(() => {
    return (
        <div className="p-4 text-zinc-800">
            {counterStore.messages.map((m, i) => m.log ?
                // <DraggableWindow x={40} y={40}><div dangerouslySetInnerHTML={{ __html: m.content.trim('`') }}></div></DraggableWindow>
                <React.Fragment key={'msg' + i}>
                    <div className="px-2 text-light tracking-tight text-gray-400">{m.log}</div>
                </React.Fragment>
                : <React.Fragment key={'msg' + i}>
                    <div className="px-2 mt-2">{m.from}</div>
                    <div className="px-2 text-light tracking-tight" dangerouslySetInnerHTML={{ __html: marked.parse(m.content) }}></div>
                </React.Fragment>
            )}
        </div>
    );
});

(window as any).doAction = (...args: any[]) => {
    const win = counterStore.windows.find(w => w.id === activeWindowStore.activeWindow);
    win.loading = true;
    counterStore.doAction(activeWindowStore.activeWindow || 0, win.inputs, ...args);
}

const WindowList = observer(() => {
    const onChange = (_: any, e: any) => console.log('change', e);
    const onInput = (m: any, e: any) => {
        console.log('input', e.target.id, e.target.value);
        if (!m.inputs) { m.inputs = {}; }
        m.inputs[e.target.id] = e.target.value;
    };

    return (<>
        {
            counterStore.windows.map((m) =>
                <DraggableWindow data={m} modal={false} minimized={m.minimized} windowKey={m.id} key={m.id} loading={m.loading} title={m.title}>
                    <div onInput={(e) => onInput(m, e)} onChange={(e) => onChange(m, e)} dangerouslySetInnerHTML={{ __html: m.content.replace(/`/g, '') }}></div>
                </DraggableWindow>
            )
        }
    </>
    );
});

export const ChatBox = observer(() => {
    const [message, setMessage] = useState('');
    const handleMessageChange = (event: any) => {
        setMessage(event.target.value);
    };
    const sendMessage = () => {
        counterStore.sendChat(message);
        setMessage('');
    };

    const handleFocus = () => {
        activeWindowStore.setActiveWindow(null);
    }
    const connected = connectionStatus.connected;
    const connecting = connectionStatus.connecting;

    return <>
        <WindowList />
        <ShareModal />
        <div className="fixed bottom-6 left-1/2 w-full max-w-2xl px-4 group" style={{ transform: 'translateX(-50%)' }}>

            <div className="overflow-hidden group-focus-within:h-[400px] h-0 transition-[height,opacity] opacity-0 group-focus-within:opacity-100
              rounded-xl bg-white/90 border border-white/40 shadow-sm overflow-y-auto text-sm text-zinc-700 mb-4">
                <MessageList />
            </div>

            <div className="flex items-center gap-3 rounded-2xl group-focus-within:bg-white/70 bg-white/30 backdrop-blur-xl border border-white/40 shadow-xl"
                style={{ backgroundColor: connected ? undefined : connecting ? 'rgba(128,128,255,0.2)' : 'rgba(255,64,64,0.2)' }}>
                {/* Text input */}
                <textarea value={message} onFocus={handleFocus} onChange={handleMessageChange}
                    rows={1}
                    placeholder={connected ? "Let's change the world..." : connecting ? 'Connecting...' : 'Disconnected'}
                    className="flex-1 resize-none bg-transparent outline-none p-4 text-zinc-100 group-focus-within:text-zinc-900 placeholder:text-zinc-100/50 group-focus-within:placeholder:text-zinc-500 leading-relaxed max-h-32"
                    onInput={(e: any) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                    }}
                />

                {/* Send button */}
                <button onClick={sendMessage} className="flex items-center justify-center mx-4 w-9 h-9 rounded-xl bg-black text-white hover:bg-zinc-800
          active:scale-95 transition shadow">
                    ↑
                </button>

            </div>
        </div>
    </>
});