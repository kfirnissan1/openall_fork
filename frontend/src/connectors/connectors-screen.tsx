import { observer } from "mobx-react-lite";
import DraggableWindow from "../draggable-window";
import { windowStateStore } from "../windows/windowState";

export const SettingsContent = observer(() => {

    const mcpContent = `{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    }
  }
}`


    return <>
        <div>The json configuration containing the MCPs to be used when executing AI commands</div>
        <div spellCheck="false" className="flex-1 rounded-xl bg-white/80 text-gray-600 border-gray-400 border p-2 my-2 whitespace-pre-wrap text-sm font-mono" contentEditable="true">{mcpContent}</div>
        <div className="flex justify-end">
            <button onClick={() => { }}
                className="w-32 mr-1 py-2 rounded-xl bg-gray-900/80 hover:bg-gray-900 text-white font-medium shadow-md transition">
                Save
            </button>
            <button onClick={() => { windowStateStore.setShowConnectors(false) }}
                className="w-32 ml-1 py-2 rounded-xl bg-gray-300/80 hover:bg-gray-300 text-black font-medium shadow-md transition">
                Close
            </button>
        </div>
    </>;
});

export const ConnectorsScreen = observer(() => {
    const m = { minimized: false, title: 'MCPs & Connectors', id: -1, };

    return (<>
        <div>
            <DraggableWindow loading={false} data={m} modal={true} minimized={m.minimized} windowKey={'win' + m.id} key={'win' + m.id} title={m.title} h={610} w={800}>
                <SettingsContent />
            </DraggableWindow>
        </div>
    </>);
});