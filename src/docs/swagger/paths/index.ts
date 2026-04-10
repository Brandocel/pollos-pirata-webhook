import { healthPaths } from "./health.paths";
import { oauthPaths } from "./oauth.paths";
import { integrationPaths } from "./integration.paths";
import { storePaths } from "./store.paths";
import { menuPaths } from "./menu.paths";
import { ordersPaths } from "./orders.paths";
import { webhookPaths } from "./webhook.paths";

export const swaggerPaths = {
  ...healthPaths,
  ...oauthPaths,
  ...integrationPaths,
  ...storePaths,
  ...menuPaths,
  ...ordersPaths,
  ...webhookPaths
};