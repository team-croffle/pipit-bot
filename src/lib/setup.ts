process.env.NODE_ENV ??= "development";

// oxlint-disable-next-line import/no-unassigned-import
import { join } from "node:path";
import "@sapphire/plugin-logger/register";
import {
  ApplicationCommandRegistries,
  RegisterBehavior,
  container,
} from "@sapphire/framework";
import * as colorette from "colorette";

import { loadEnv } from "./env.js";
import { initRuntimeConfig } from "./runtime-config.js";

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
);

export const env = loadEnv();
container.config = env;

initRuntimeConfig(join(env.streamRoot, "runtime-config.json"), {
  prefix: "!",
  commandChannelId: undefined,
});

colorette.createColors({ useColor: true });
