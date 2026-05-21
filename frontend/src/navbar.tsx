import { useState } from "react";
import { counterStore } from "./chat-box";

export default function Navbar() {
    const [expanded, setExpanded] = useState(false);

    const showSettings = () => counterStore.setShowSettings(true);

    const items = [
        // {
        //     icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>`, label: "Dashboard"
        // },
        // { icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-120q-33 0-56.5-23.5T40-200v-520h80v520h680v80H120Zm160-160q-33 0-56.5-23.5T200-360v-440q0-33 23.5-56.5T280-880h200l80 80h280q33 0 56.5 23.5T920-720v360q0 33-23.5 56.5T840-280H280Zm0-80h560v-360H527l-80-80H280v440Zm0 0v-440 440Z"/></svg>`, label: "Projects" },
        // { icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>`, label: "Documents" },
        { click: showSettings, icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>`, label: "Settings" },
    ];

    return (
        <div onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
            className={`fixed z-30 left-4 top-1/2 -translate-y-1/2 ${expanded ? "w-64" : "w-16"} p-2 rounded-2xl bg-white/60 backdrop-blur-2xl 
                border border-white/40 shadow-2xl transition-all duration-300 ease-out flex flex-col gap-2`}>
            {/* Header */}
            <div className={`flex items-center ${expanded ? "justify-between px-3" : "justify-center"} py-2 h-10 rounded-xl bg-white/40 border border-white/30 transition-all`}>
                {expanded ? (
                    <>
                        <span className="text-sm font-medium text-zinc-700 select-none">
                            Workspace
                        </span>

                        <div className="flex gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                    </>
                ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                )}
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2">
                {items.map((item) => (
                    <div key={item.label} className="group relative flex items-center">
                        <div onClick={item.click} className={`flex items-center ${expanded ? "justify-start px-3 gap-3" : "justify-center"} w-full py-2 overflow-hidden rounded-xl
              bg-white/70 border border-white/40 shadow-sm text-sm text-zinc-700 hover:bg-white/80 hover:shadow-md transition-all cursor-pointer`}>
                            <span className="text-lg" dangerouslySetInnerHTML={{ __html: item.icon }}></span>

                            {/* Label */}
                            <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                                {item.label}
                            </span>
                        </div>

                        {/* Hover actions (only when expanded) */}
                        {expanded && (
                            <div className="absolute right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-200/70 transition">
                                    →
                                </button>
                                <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500 hover:text-white transition">
                                    ×
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            {/* <button className={`mt-1 w-full py-2 flex items-center justify-center rounded-xl transition-all overflow-hidden ${expanded ? "bg-black text-white hover:bg-zinc-800" : "bg-white/70 hover:bg-white/90"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" /></svg>
                {expanded ? "New" : ""}
            </button> */}
        </div>
    );
}