// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  deferred,
  Deferred,
} from "./vendor/https/deno.land/std/async/mod.ts";
import { TimeoutError } from "./error.ts";

export function pathResolver(meta: ImportMeta): (p: string) => string {
  return (p) => new URL(p, meta.url).pathname;
}

export interface PromiseWaitQueue<T, P> {
  enqueue(t: T): Promise<P>;
}

export function promiseWaitQueue<T, P>(
  creator: (t: T) => Promise<P>,
): PromiseWaitQueue<T, P> {
  const queue: {
    d: Deferred<P>;
    t: T;
  }[] = [];
  function enqueue(t: T): Promise<P> {
    const d = deferred<P>();
    queue.push({ d, t });
    if (queue.length === 1) {
      dequeue();
    }
    return d;
  }
  function dequeue() {
    const [e] = queue;
    if (!e) return;
    creator(e.t)
      .then(e.d.resolve)
      .catch(e.d.reject)
      .finally(() => {
        queue.shift();
        dequeue();
      });
  }
  return { enqueue };
}

/** returns curried promise factory that  */
export function promiseInterrupter({
  timeout = -1,
  cancel,
}: {
  timeout?: number;
  cancel?: Promise<void>;
}): <T>(p: Promise<T>) => Promise<T> {
  timeout = Number.isInteger(timeout) ? timeout : -1;
  return <T>(p: Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      if (timeout < 0) {
        p.then(resolve).catch(reject);
        if (cancel) {
          cancel.then(reject).catch(reject);
        }
      } else {
        const i = setTimeout(() => {
          reject(new TimeoutError());
        }, timeout);
        const clear = () => clearTimeout(i);
        p.then(resolve)
          .catch(reject)
          .finally(clear);
        if (cancel) {
          cancel
            .then(reject)
            .catch(reject)
            .finally(clear);
        }
      }
    });
}
