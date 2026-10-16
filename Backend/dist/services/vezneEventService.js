import EventEmitter from "events";
class VezneEventEmitter extends EventEmitter {
}
export const vezneEvents = new VezneEventEmitter();
vezneEvents.setMaxListeners(200);
export function notifyVezneBakiyeDegisti(details) {
    try {
        vezneEvents.emit("bakiyeChanged", {
            type: "BAKIYE_CHANGED",
            timestamp: Date.now(),
            ...details,
        });
    }
    catch (err) {
        console.error("notifyVezneBakiyeDegisti error:", err);
    }
}
