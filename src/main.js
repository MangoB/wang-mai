import { createApp } from 'vue';
import App from './App.js';
import { connect } from './store.js';

connect();
createApp(App).mount('#app');
