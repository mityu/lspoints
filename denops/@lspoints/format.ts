import type { Denops } from "../lspoints/deps/denops.ts";
import type { LSP } from "../lspoints/deps/lsp.ts";
import { deadline } from "../lspoints/deps/std/async.ts";
import { assert, is } from "../lspoints/deps/unknownutil.ts";
import { BaseExtension, type Lspoints } from "../lspoints/interface.ts";
import {
  applyTextEdits,
} from "https://deno.land/x/denops_lsputil@v0.9.3/mod.ts";

export class Extension extends BaseExtension {
  initialize(denops: Denops, lspoints: Lspoints) {
    lspoints.defineCommands("format", {
      execute: async (bufnr: unknown, timeout = 5000, selector?: unknown) => {
        assert(timeout, is.Number);
        let clients = lspoints.getClients(Number(bufnr)).filter((c) =>
          c.serverCapabilities.documentFormattingProvider != null
        );
        if (is.String(selector)) {
          clients = clients.filter((c) => c.name === selector);
        }

        if (clients.length == 0) {
          throw Error("何のクライアントも選ばれてないわよ");
        }

        const path = String(await denops.call("expand", "%:p"));

        const resultPromise = lspoints.request(
          clients[0].name,
          "textDocument/formatting",
          {
            textDocument: {
              uri: "file://" + path,
            },
            options: {
              tabSize: Number(await denops.eval("&l:shiftwidth")),
              insertSpaces: Boolean(await denops.eval("&l:expandtab")),
            },
          },
        ) as Promise<LSP.TextEdit[] | null>;
        const result = await deadline(resultPromise, timeout)
          .catch(async () => {
            await denops.cmd(`
                             echohl Error
                             echomsg "Timeout!"
                             echohl None
                             `);
          });
        if (result == null) {
          return;
        }
        await applyTextEdits(
          denops,
          Number(bufnr),
          result,
        );
      },
    });
  }
}
