import type { Api } from "@/lib/api";
import type { DemoEngine } from "./engine";
import { handleDemoRequest, isPassthroughPath, type DemoMethod } from "./router";
import { DemoError } from "./types";

// 把示範引擎包成跟真 API 同一個介面。只 import lib/api 的型別：lib/api 會反過來
// import 這個檔案，值的 import 會形成 require cycle，所以 ApiError 由呼叫端用
// toError 傳進來。
export function createDemoApi(
  engine: DemoEngine,
  real: Api,
  toError: (code: string, message: string, status: number) => Error
): Api {
  const run = <T>(method: DemoMethod, path: string, body?: unknown): Promise<T> => {
    try {
      return Promise.resolve(handleDemoRequest(engine, method, path, body) as T);
    } catch (e) {
      return Promise.reject(e instanceof DemoError ? toError(e.code, e.message, e.status) : e);
    }
  };

  // 只有讀取會轉給真後端。寫入一律留在引擎裡 —— 行情 API 沒有寫入，任何寫入都
  // 不該碰到使用者的真實帳號。
  return {
    get: <T>(path: string) => (isPassthroughPath(path) ? real.get<T>(path) : run<T>("GET", path)),
    post: <T>(path: string, data: unknown) => run<T>("POST", path, data),
    put: <T>(path: string, data: unknown) => run<T>("PUT", path, data),
    patch: <T>(path: string, data: unknown) => run<T>("PATCH", path, data),
    delete: <T>(path: string) => run<T>("DELETE", path),
    rawGet: <T>(path: string) =>
      isPassthroughPath(path) ? real.rawGet<T>(path) : run<T>("GET", path),
  };
}
