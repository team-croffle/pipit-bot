import { createApp } from 'vue';

import App from './app.vue';
import { i18n, setLanguage, browserLanguage } from './i18n';
import { router } from './router';

import './styles.css';

// app.vue decides from the first route whether to draw the shell. The router starts its
// first navigation when installed; mount once that has resolved.
const app = createApp(App).use(router).use(i18n);
setLanguage(browserLanguage());
void router.isReady().then(() => app.mount('#app'));
