import type { CrmadminApi } from '../../../preload/index.js';

declare global {
  interface Window {
    crmadmin: CrmadminApi;
  }
}

export const api = window.crmadmin;
