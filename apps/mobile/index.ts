import { registerRootComponent } from "expo";
import * as Crypto from "expo-crypto";
import App from "./App";

const currentCrypto = globalThis.crypto as Crypto | undefined;
if (!currentCrypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { ...(currentCrypto ?? {}), randomUUID: Crypto.randomUUID } });
}
registerRootComponent(App);
